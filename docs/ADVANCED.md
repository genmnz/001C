# ADVANCED.md — advanced tier (after engine + WASM + GPU)

Status of the Operation Catalog's advanced tiers (A–N). `[x]` done · `[~]`
partial · `[ ]` todo. Order by legal friction: permissive ports first (flowDensity
Artistic-2.0, flowClust MIT, linfa/bhtsne/annembed, diffcyt MIT, Spectre MIT);
defer GPL clean-rooms (FlowSOM, CytoNorm, CATALYST, PeacoQC, PHATE, EmbedSOM).
Stochastic methods validated by ARI/modularity/EMD, never exact coords.

## A. Automated gating
- [x] Otsu + density-valley (mindensity) 1D auto-threshold (flowDensity/openCyto) ← `core/autogate`
- [x] Singlet gate ← `core/cleaning`
- [ ] peak/tail/quantile gating; flowClust/GMM 2D gating; openCyto CSV templates; GateNet AI

## B. Dimensionality reduction
- [x] PCA (Jacobi eigen) ← `core/reduce`
- [ ] MDS/Isomap/diffusion maps; t-SNE (Barnes-Hut); UMAP (kNN+annembed); PaCMAP; PHATE; EmbedSOM

## C. Clustering
- [x] k-means (++ seeded; Rust assign kernel) ← `core/cluster`
- [ ] FlowSOM (SOM+MST+consensus, clean-room); PhenoGraph (kNN→Jaccard→Leiden); DBSCAN/HDBSCAN/GMM/hierarchical

## D. Cell population discovery
- [ ] rare/novel detection; marker enrichment; cell typing; atlas mapping; trajectory

## E. Differential analysis
- [x] Differential abundance (per-sample freq + Mann-Whitney) ← `core/stats/comparative`
- [ ] diffcyt NB-GLM (edgeR-style) DA; limma-style moderated DS; GLMM; survival

## F. Batch effects
- [ ] CytoNorm (FlowSOM + per-cluster quantile splines, clean-room); quantile/reference normalization; drift correction

## G. Machine learning
- [ ] RF/SVM/logistic (linfa/smartcore); NN/CNN (candle/burn); feature importance/SHAP

## H. Spatial cytometry
- [ ] coordinates; neighborhood (kd-tree); cell-cell interaction; spatial clustering/enrichment

## I. CyTOF-specific
- [ ] bead normalization (Finck 2013); debarcoding (Zunder/Finck); isotope spillover (NNLS)

## J. Spectral flow
- [x] core unmixing OLS/NNLS (see §3) ← `core/compensation/unmix`
- [ ] WLS/Poisson; per-cell autofluorescence; spectral signature library/QC/residuals

## K. Multi-sample
- [~] population frequency vectors per sample (diff-abundance input)
- [ ] cohort comparison/aggregation; cross-sample matching; consensus pops; sample similarity

## L. Workspace / serialization
- [x] native workspace doc save/load (gates+transform+axes+metadata) ← `engine-controller/workspace`
- [ ] undo/redo; audit trail; gate templates; FlowJo .wsp / Gating-ML 2.0 import (reimpl, not CytoML)

## M. Collaboration (LAST)
- [ ] shared projects; comments; review/approval; version control; permissions

## N. Enterprise / platform (LAST)
- [~] WebGPU rendering; WASM analysis (present); out-of-core for >4 GB
- [ ] distributed/cloud; pipelines; scheduled analysis; API; server-side native Rust for billions
