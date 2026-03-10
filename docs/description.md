# Overview

This block matches clonotypes between two VDJ datasets, enabling integration of bulk and single-cell sequencing data. It is designed for antibody discovery workflows where researchers need to identify which clonotypes from a deep bulk sequencing run also appear in a paired single-cell VDJ dataset.

The block takes two clonotyping run outputs as inputs — a target dataset and a reference dataset. It performs exact matching on nucleotide or amino acid sequences along with V and J gene usage, automatically selecting the widest shared sequence feature (e.g. VDJRegion or CDR3) available in both datasets.

When a clonotype matches multiple candidates, the block selects the best match and reports a confidence score (1.0 for unique matches, decreasing for ambiguous ones). The output includes bidirectional linker columns that allow downstream blocks such as lead selection, SHM trees, and GraphMaker to join data across the two datasets.
