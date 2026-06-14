# ADVANCED.md — advanced tier (after engine + WASM + GPU)

Status of the Operation Catalog's advanced tiers (A–N). `[x]` done · `[~]`
partial · `[ ]` todo. Order by legal friction: permissive ports first (flowDensity
Artistic-2.0, flowClust MIT, linfa/bhtsne/annembed, diffcyt MIT, Spectre MIT);
defer GPL clean-rooms (FlowSOM, CytoNorm, CATALYST, PeacoQC, PHATE, EmbedSOM).
Stochastic methods validated by ARI/modularity/EMD, never exact coords.

## A. Automated gating
- [x] Otsu + density-valley (mindensity) 1D auto-threshold (flowDensity/openCyto) ← `core/autogate`
- [x] Quantile gate + tail gate (KDE-based) ← `core/autogate`
- [x] Singlet gate ← `core/cleaning`
- [~] GMM/mixture-model gating backbone available (`core/cluster/gmm`); wiring to 2D gates TODO
- [ ] peak-detection; openCyto CSV templates; GateNet AI

## B. Dimensionality reduction
- [x] PCA (Jacobi eigen) ← `core/reduce`
- [x] t-SNE (exact, perplexity-calibrated; neighbor-preservation tested) ← `core/reduce`
- [x] UMAP (fuzzy simplicial set + SGD; neighbor-preservation tested) ← `core/reduce`
- [ ] MDS/Isomap/diffusion maps; PaCMAP; PHATE; EmbedSOM

## C. Clustering
- [x] k-means (++ seeded; Rust assign kernel) ← `core/cluster`
- [x] DBSCAN (density-based; noise = -1) ← `core/cluster`
- [x] FlowSOM (SOM + MST + k-means metacluster, clean-room) ← `core/cluster`
- [x] GMM (EM, diagonal covariance) ← `core/cluster`
- [x] PhenoGraph (kNN→Jaccard→Louvain; communities never span blobs) ← `core/cluster` + `core/graph`
- [ ] HDBSCAN; hierarchical; spectral; consensus metaclustering; Leiden refinement

## D. Cell population discovery
- [ ] rare/novel detection; marker enrichment; cell typing; atlas mapping; trajectory

## E. Differential analysis
- [x] Differential abundance (per-sample freq + Mann-Whitney) ← `core/stats/comparative`
- [x] Cluster×sample abundance matrix + rank-based DA + BH-FDR (diffcyt-style) ← `core/diff`
- [ ] edgeR NB-GLM DA; limma moderated DS; GLMM; survival

## F. Batch effects
- [x] CytoNorm (per-cluster quantile normalization to a goal, clean-room) ← `core/normalize`
- [ ] reference/control normalization; drift correction; instrument harmonization

## G. Machine learning
- [x] Logistic regression (IRLS) + accuracy ← `core/ml`
- [ ] RF/SVM; NN/CNN; feature importance/SHAP

## H. Spatial cytometry
- [x] Neighborhood enrichment (kNN co-occurrence vs frequency model) ← `core/spatial`
- [ ] cell-cell interaction; spatial clustering; tissue-region annotation

## I. CyTOF-specific
- [x] Bead normalization (Finck 2013) + single-cell debarcoding (Zunder/Finck) ← `core/cytof`
- [ ] isotope/metal spillover (NNLS via core/compensation/unmix)

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
