---
"@platforma-open/milaboratories.vdj-integration": patch
"@platforma-open/milaboratories.vdj-integration.model": patch
"@platforma-open/milaboratories.vdj-integration.ui": patch
"@platforma-open/milaboratories.vdj-integration.workflow": patch
---

Update the SDK and build the dataset lists with buildDatasetOptions (requireEnrichments: false), replacing the custom merge of datasets and their subset filters. Dataset labels are unchanged. The results table no longer comes out empty when a clonotype lacks one of the chains: matches are kept and missing chains are left blank.
