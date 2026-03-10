import argparse
import re
import polars as pl


def strip_allele(gene: str | None) -> str:
    """Remove allele suffix (*NN) from gene name."""
    if gene is None:
        return ""
    return re.sub(r"\*\d+$", "", gene)


def read_tsv(path: str) -> pl.DataFrame:
    return pl.read_csv(path, separator="\t")


def melt_chains(df: pl.DataFrame, prefix: str) -> pl.DataFrame:
    """Melt per-chain columns into rows.

    Input columns: clonotypeKey, sequence_0, vGene_0, jGene_0, sequence_1, vGene_1, jGene_1, ...
    Output columns: clonotypeKey, sequence, vGene, jGene
    """
    seq_cols = sorted([c for c in df.columns if c.startswith("sequence_")])
    if not seq_cols:
        return df.select("clonotypeKey").with_columns(
            pl.lit(None).alias("sequence"),
            pl.lit(None).alias("vGene"),
            pl.lit(None).alias("jGene"),
        )

    frames = []
    for seq_col in seq_cols:
        idx = seq_col.split("_")[-1]
        v_col = f"vGene_{idx}"
        j_col = f"jGene_{idx}"

        cols = ["clonotypeKey", seq_col]
        renames = {seq_col: "sequence"}
        if v_col in df.columns:
            cols.append(v_col)
            renames[v_col] = "vGene"
        if j_col in df.columns:
            cols.append(j_col)
            renames[j_col] = "jGene"

        chunk = df.select(cols).rename(renames)
        if "vGene" not in chunk.columns:
            chunk = chunk.with_columns(pl.lit(None).cast(pl.Utf8).alias("vGene"))
        if "jGene" not in chunk.columns:
            chunk = chunk.with_columns(pl.lit(None).cast(pl.Utf8).alias("jGene"))

        frames.append(chunk)

    melted = pl.concat(frames)
    # Drop rows where sequence is null
    melted = melted.filter(pl.col("sequence").is_not_null() & (pl.col("sequence") != ""))
    return melted


def build_match_key(df: pl.DataFrame) -> pl.DataFrame:
    """Add stripped V/J gene columns and match_key."""
    df = df.with_columns(
        pl.col("vGene").map_elements(strip_allele, return_dtype=pl.Utf8).alias("vGene_stripped"),
        pl.col("jGene").map_elements(strip_allele, return_dtype=pl.Utf8).alias("jGene_stripped"),
    )
    df = df.with_columns(
        (pl.col("sequence") + "|" + pl.col("vGene_stripped") + "|" + pl.col("jGene_stripped")).alias("match_key")
    )
    return df


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="Path to target TSV")
    parser.add_argument("--reference", required=True, help="Path to reference TSV")
    parser.add_argument("--to-reference", required=True, help="Output path for toReference linker")
    parser.add_argument("--to-target", required=True, help="Output path for toTarget linker")
    parser.add_argument("--target-match-count", required=True, help="Output path for target match counts")
    parser.add_argument("--ref-match-count", required=True, help="Output path for reference match counts")
    return parser.parse_args()


def main():
    args = parse_args()

    target_df = read_tsv(args.target)
    ref_df = read_tsv(args.reference)

    # Melt per-chain columns into rows
    target_melted = melt_chains(target_df, "target")
    ref_melted = melt_chains(ref_df, "reference")

    # Build match keys
    target_keyed = build_match_key(target_melted)
    ref_keyed = build_match_key(ref_melted)

    # Join on match_key
    pairs = target_keyed.select(["clonotypeKey", "match_key"]).join(
        ref_keyed.select(["clonotypeKey", "match_key"]),
        on="match_key",
        suffix="_ref"
    ).select([
        pl.col("clonotypeKey").alias("targetKey"),
        pl.col("clonotypeKey_ref").alias("referenceKey")
    ]).unique()

    if pairs.height == 0:
        # No matches found — write empty output files
        pl.DataFrame({"referenceKey": [], "targetKey": [], "link": []}).write_csv(args.to_reference, separator="\t")
        pl.DataFrame({"targetKey": [], "referenceKey": [], "link": []}).write_csv(args.to_target, separator="\t")
        pl.DataFrame({"clonotypeKey": [], "matchCount": [], "confidence": []}).write_csv(args.target_match_count, separator="\t")
        pl.DataFrame({"clonotypeKey": [], "matchCount": [], "confidence": []}).write_csv(args.ref_match_count, separator="\t")
        return

    # For each target key, count how many reference keys match
    target_counts = pairs.group_by("targetKey").agg(pl.col("referenceKey").count().alias("matchCount"))
    # Pick best reference for each target (first lexicographic)
    target_best = pairs.sort("referenceKey").group_by("targetKey").first()

    # For each reference key, count how many target keys match
    ref_counts = pairs.group_by("referenceKey").agg(pl.col("targetKey").count().alias("matchCount"))
    # Pick best target for each reference (first lexicographic)
    ref_best = pairs.sort("targetKey").group_by("referenceKey").first()

    # toReference.tsv: referenceKey -> targetKey linker (from best match per reference)
    to_reference = ref_best.select([
        pl.col("referenceKey"),
        pl.col("targetKey")
    ]).with_columns(pl.lit(1).alias("link"))
    to_reference.write_csv(args.to_reference, separator="\t")

    # toTarget.tsv: targetKey -> referenceKey linker (from best match per target)
    to_target = target_best.select([
        pl.col("targetKey"),
        pl.col("referenceKey")
    ]).with_columns(pl.lit(1).alias("link"))
    to_target.write_csv(args.to_target, separator="\t")

    # targetMatchCount.tsv
    target_match_count = target_counts.with_columns(
        (1.0 / pl.col("matchCount")).alias("confidence")
    ).rename({"targetKey": "clonotypeKey"})
    target_match_count.write_csv(args.target_match_count, separator="\t")

    # refMatchCount.tsv
    ref_match_count = ref_counts.with_columns(
        (1.0 / pl.col("matchCount")).alias("confidence")
    ).rename({"referenceKey": "clonotypeKey"})
    ref_match_count.write_csv(args.ref_match_count, separator="\t")


if __name__ == "__main__":
    main()
