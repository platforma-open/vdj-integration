# @platforma-open/milaboratories.vdj-integration.workflow

## 2.1.0

### Minor Changes

- 2fe54a6: Support dataset filters from Repertoire Labeling and other subset columns

  - The target and the reference repertoire can each be narrowed by one of their subset columns (for example a Repertoire Labeling label or a Lead Selection pick): only the subsets' clonotypes are matched, and the match statistics count within them.
  - Both dataset filters are part of the block's template parameters, so a template made from a filtered block reproduces the filtered run.
  - Each side's Match Count and Confidence computed on a subset carry the subset's column id in `pl7.app/inputSubset`.
  - The default block label shows the picked subsets.
  - Sequence type and Matching region no longer reset when switching back to the block: the Nucleotide preference applies only after picking new datasets, and the Matching region keeps its value while its options load.

## 2.0.2

### Patch Changes

- 2161ea6: Migrate onto the structurer and upgrade the SDK: model/ui-vue 1.61 → 1.83.17, workflow-tengo 5.11 → 6.10.3, tengo-builder 2.5.2 → 4.0.27, block-tools 2.7.2 → 2.15.2. Adds the mandatory block kind with an init-params contract, so the block can be created from a project template.
- Updated dependencies [2161ea6]
  - @platforma-open/milaboratories.vdj-integration.software@2.0.2

## 2.0.1

### Patch Changes

- c7aec17: UX improvement
- Updated dependencies [c7aec17]
  - @platforma-open/milaboratories.vdj-integration.software@2.0.1

## 2.0.0

### Major Changes

- 70d8503: VDJ Block initial implementation

### Patch Changes

- Updated dependencies [70d8503]
  - @platforma-open/milaboratories.vdj-integration.software@2.0.0
