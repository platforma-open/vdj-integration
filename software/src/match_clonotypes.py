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


def build_match_key(df: pl.DataFrame, use_gene_matching: bool = True) -> pl.DataFrame:
    """Add match_key column. When use_gene_matching is True, includes stripped V/J genes."""
    if use_gene_matching:
        df = df.with_columns(
            pl.col("vGene").map_elements(strip_allele, return_dtype=pl.Utf8).alias("vGene_stripped"),
            pl.col("jGene").map_elements(strip_allele, return_dtype=pl.Utf8).alias("jGene_stripped"),
        )
        df = df.with_columns(
            (pl.col("sequence") + "|" + pl.col("vGene_stripped") + "|" + pl.col("jGene_stripped")).alias("match_key")
        )
    else:
        df = df.with_columns(
            pl.col("sequence").alias("match_key")
        )
    return df


def aggregate_abundance(path: str) -> pl.DataFrame:
    """Read per-sample abundance TSV and sum across samples per clonotype."""
    df = read_tsv(path)
    return df.group_by("clonotypeKey").agg(
        pl.col("abundance").sum().alias("totalAbundance")
    )


def write_empty_outputs(args):
    """Write empty output files when no matches are found."""
    pl.DataFrame({"referenceKey": [], "targetKey": [], "link": []}).write_csv(args.to_reference, separator="\t")
    pl.DataFrame({"targetKey": [], "referenceKey": [], "link": []}).write_csv(args.to_target, separator="\t")
    pl.DataFrame({"clonotypeKey": [], "matchCount": [], "confidence": []}).write_csv(args.target_match_count, separator="\t")
    pl.DataFrame({"clonotypeKey": [], "matchCount": [], "confidence": []}).write_csv(args.ref_match_count, separator="\t")


def write_stats(path: str, target_total: int, target_matched: int, ref_total: int, ref_matched: int):
    """Write match statistics TSV."""
    pl.DataFrame({
        "side": ["target", "reference"],
        "matched": [target_matched, ref_matched],
        "total": [target_total, ref_total]
    }).write_csv(path, separator="\t")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, help="Path to target TSV")
    parser.add_argument("--reference", required=True, help="Path to reference TSV")
    parser.add_argument("--target-abundance", required=True, help="Path to target abundance TSV")
    parser.add_argument("--ref-abundance", required=True, help="Path to reference abundance TSV")
    parser.add_argument("--to-reference", required=True, help="Output path for toReference linker")
    parser.add_argument("--to-target", required=True, help="Output path for toTarget linker")
    parser.add_argument("--target-match-count", required=True, help="Output path for target match counts")
    parser.add_argument("--ref-match-count", required=True, help="Output path for reference match counts")
    parser.add_argument("--stats", required=True, help="Output path for match statistics")
    parser.add_argument("--no-gene-matching", action="store_true", help="Match by sequence only, ignoring V/J genes")
    return parser.parse_args()


def main():
    args = parse_args()

    target_df = read_tsv(args.target)
    ref_df = read_tsv(args.reference)

    target_total_clonotypes = target_df["clonotypeKey"].n_unique()
    ref_total_clonotypes = ref_df["clonotypeKey"].n_unique()

    # Read and aggregate abundance per clonotype (sum across samples)
    target_abundance = aggregate_abundance(args.target_abundance)
    ref_abundance = aggregate_abundance(args.ref_abundance)

    # Melt per-chain columns into rows
    target_melted = melt_chains(target_df, "target")
    ref_melted = melt_chains(ref_df, "reference")

    # Build match keys
    use_genes = not args.no_gene_matching
    target_keyed = build_match_key(target_melted, use_genes)
    ref_keyed = build_match_key(ref_melted, use_genes)

    # Join on match_key
    pairs = target_keyed.select(["clonotypeKey", "match_key"]).join(
        ref_keyed.select(["clonotypeKey", "match_key"]),
        on="match_key",
        suffix="_ref"
    ).select([
        pl.col("clonotypeKey").alias("targetKey"),
        pl.col("clonotypeKey_ref").alias("referenceKey")
    ]).unique().sort("targetKey", "referenceKey")

    if pairs.height == 0:
        write_empty_outputs(args)
        write_stats(args.stats, target_total_clonotypes, 0, ref_total_clonotypes, 0)
        return

    # Match counts per side
    target_counts = pairs.group_by("targetKey").agg(pl.col("referenceKey").count().alias("matchCount"))
    ref_counts = pairs.group_by("referenceKey").agg(pl.col("targetKey").count().alias("matchCount"))

    # --- Target → Reference direction (use reference abundance to rank) ---
    pairs_with_ref_abund = pairs.join(
        ref_abundance.rename({"clonotypeKey": "referenceKey", "totalAbundance": "refAbundance"}),
        on="referenceKey", how="left"
    )
    # Best reference per target: highest abundance
    target_best = pairs_with_ref_abund.sort("refAbundance", descending=True).group_by("targetKey").first()
    # Confidence: best_abundance / sum(all candidate abundances)
    target_abund_sum = pairs_with_ref_abund.group_by("targetKey").agg(
        pl.col("refAbundance").sum().alias("sumRefAbundance")
    )
    target_best = target_best.join(target_abund_sum, on="targetKey")
    target_best = target_best.with_columns(
        (pl.col("refAbundance") / pl.col("sumRefAbundance")).alias("confidence")
    )

    # --- Reference → Target direction (use target abundance to rank) ---
    pairs_with_target_abund = pairs.join(
        target_abundance.rename({"clonotypeKey": "targetKey", "totalAbundance": "targetAbundance"}),
        on="targetKey", how="left"
    )
    # Best target per reference: highest abundance
    ref_best = pairs_with_target_abund.sort("targetAbundance", descending=True).group_by("referenceKey").first()
    # Confidence: best_abundance / sum(all candidate abundances)
    ref_abund_sum = pairs_with_target_abund.group_by("referenceKey").agg(
        pl.col("targetAbundance").sum().alias("sumTargetAbundance")
    )
    ref_best = ref_best.join(ref_abund_sum, on="referenceKey")
    ref_best = ref_best.with_columns(
        (pl.col("targetAbundance") / pl.col("sumTargetAbundance")).alias("confidence")
    )

    # --- Write linker outputs (confidence as link value) ---

    # toReference.tsv
    to_reference = ref_best.select([
        pl.col("referenceKey"),
        pl.col("targetKey"),
        pl.col("confidence").alias("link")
    ]).sort("referenceKey", "targetKey")
    to_reference.write_csv(args.to_reference, separator="\t")

    # toTarget.tsv
    to_target = target_best.select([
        pl.col("targetKey"),
        pl.col("referenceKey"),
        pl.col("confidence").alias("link")
    ]).sort("targetKey", "referenceKey")
    to_target.write_csv(args.to_target, separator="\t")

    # --- Write match count outputs ---

    # targetMatchCount.tsv
    target_match_count = target_counts.join(
        target_best.select(["targetKey", "confidence"]), on="targetKey", how="left"
    ).rename({"targetKey": "clonotypeKey"}).select(
        ["clonotypeKey", "matchCount", "confidence"]
    ).sort("clonotypeKey")
    target_match_count.write_csv(args.target_match_count, separator="\t")

    # refMatchCount.tsv
    ref_match_count = ref_counts.join(
        ref_best.select(["referenceKey", "confidence"]), on="referenceKey", how="left"
    ).rename({"referenceKey": "clonotypeKey"}).select(
        ["clonotypeKey", "matchCount", "confidence"]
    ).sort("clonotypeKey")
    ref_match_count.write_csv(args.ref_match_count, separator="\t")

    # --- Write statistics ---
    write_stats(args.stats, target_total_clonotypes, target_counts.height, ref_total_clonotypes, ref_counts.height)


if __name__ == "__main__":
    main()
