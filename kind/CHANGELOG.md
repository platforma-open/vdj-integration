# @platforma-open/milaboratories.vdj-integration.kind

## 1.1.0

### Minor Changes

- 2fe54a6: Support dataset filters from Repertoire Labeling and other subset columns

  - The target and the reference repertoire can each be narrowed by one of their subset columns (for example a Repertoire Labeling label or a Lead Selection pick): only the subsets' clonotypes are matched, and the match statistics count within them.
  - Both dataset filters are part of the block's template parameters, so a template made from a filtered block reproduces the filtered run.
  - Each side's Match Count and Confidence computed on a subset carry the subset's column id in `pl7.app/inputSubset`.
  - The default block label shows the picked subsets.
  - Sequence type and Matching region no longer reset when switching back to the block: the Nucleotide preference applies only after picking new datasets, and the Matching region keeps its value while its options load.
