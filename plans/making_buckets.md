# Plan: Learn Left and Right Context Buckets

## Deliverable

Produce two deterministic mappings:

```text
left_id(feature_pattern)
right_id(feature_pattern)
```

Every dictionary entry must resolve to one left ID and one right ID through either an exact pattern, a lexical exception, or a backoff pattern. Left and right buckets are trained independently.

Expected artifacts:

```text
artifacts/buckets/feature_schema.json
artifacts/buckets/left_buckets.json
artifacts/buckets/right_buckets.json
artifacts/buckets/left_model.joblib
artifacts/buckets/right_model.joblib
artifacts/buckets/bucket_report.json
```

Connection costs, word costs, lattice construction, and Viterbi decoding are outside this plan.

## 1. Define the Clustering Unit

Create one canonical `feature_pattern` for each dictionary analysis. Use grammatical fields:

```text
POS
sub-POS
conjugation type
conjugation form
```

Include the lemma or surface only for an explicit closed-class whitelist, initially:

```text
particles
auxiliaries
punctuation
selected highly grammatical verbs such as する, ある, and いる
```

Do not include definitions, embeddings, semantic categories, or unrestricted content-word surfaces.

Implement a stable serialized key such as:

```text
pos=VERB|subpos=INDEPENDENT|ctype=ICHIDAN|cform=CONTINUATIVE|lex=*
```

Use the same canonicalization for dictionary entries and gold tokens. Store the schema and lexicalization whitelist in `feature_schema.json`.

## 2. Split the Corpus

Split by document, not by token:

```text
train: 80%
development: 10%
test: 10%
```

Use training data to construct and modify buckets. Use development data to select settings and accept or reject refinements. Leave test data untouched until the bucket procedure is finalized.

Fix and record the split seed and document IDs.

## 3. Collect Directional Behavior Counts

Add reserved `BOS` and `EOS` patterns. For every adjacent pair in each sentence:

```text
previous -> current
```

update:

```python
right_counts[previous_pattern][current_context] += 1
left_counts[current_pattern][previous_context] += 1
```

The context key should use the same grammatical pattern representation. Maintain separate training, development, and test counts.

Store per-pattern support:

```python
left_support[x] = sum(left_counts[x].values())
right_support[x] = sum(right_counts[x].values())
```

Add unit tests using a short hand-written sentence to verify that:

```text
left behavior contains predecessors
right behavior contains successors
BOS contributes only as a predecessor
EOS contributes only as a successor
```

## 4. Define Backoff Patterns

Construct a deterministic backoff chain for every feature pattern:

```text
lexicalized full pattern
-> POS + sub-POS + conjugation type + conjugation form
-> POS + sub-POS + conjugation form
-> POS + conjugation form
-> POS
-> UNKNOWN
```

Set initial support thresholds separately for the two directions, for example:

```text
minimum independent support: 50 transitions
strong independent support: 200 transitions
```

Patterns below the minimum threshold inherit their parent bucket. Patterns between the thresholds may receive a smoothed behavior vector but may not create a lexical exception.

For a partially observed pattern, smooth its distribution toward its parent:

```text
smoothed(x) = (counts(x) + alpha * distribution(parent))
              / (support(x) + alpha)
```

Start with `alpha = 50` and tune it on development loss.

## 5. Build the Sparse Behavior Matrices

Build two matrices with `sklearn.feature_extraction.DictVectorizer`:

```text
X_left[row=target pattern, column=predecessor context]
X_right[row=target pattern, column=successor context]
```

Keep a stable `row_patterns` list so each matrix row can be mapped back to its feature pattern.

For each direction:

```python
vectorizer = DictVectorizer(sparse=True, sort=True)
X = vectorizer.fit_transform(behavior_dicts)
```

Normalize each row to remove raw frequency as the dominant signal:

```python
X = sklearn.preprocessing.normalize(X, norm="l1", axis=1)
X.data = numpy.sqrt(X.data)
```

The square-root transform makes Euclidean distance better reflect differences between probability distributions.

Verify that every retained row is finite and nonempty. Route empty rows directly through backoff rather than passing them to clustering.

## 6. Create Compact Behavior Vectors

Train `TruncatedSVD` separately for left and right matrices. Try:

```text
no SVD
32 components
64 components
128 components
```

Never request more components than the matrix dimensions allow. L2-normalize the resulting dense vectors before KMeans:

```python
svd = TruncatedSVD(n_components=d, random_state=seed)
Z = svd.fit_transform(X)
Z = sklearn.preprocessing.normalize(Z, norm="l2")
```

Treat SVD as optional. Retain the unsimplified sparse baseline and select SVD size using development results.

## 7. Train Initial Buckets

Train left and right models independently with `KMeans`. Search separate bucket counts:

```text
16, 32, 48, 64, 96, 128, 192, 256
```

Initial configuration:

```python
KMeans(
    n_clusters=k,
    init="k-means++",
    n_init=20,
    max_iter=300,
    tol=1e-4,
    random_state=seed,
)
```

Fit only patterns with enough independent support. Supply capped support weights so reliable patterns matter more without allowing a few common patterns to dominate:

```python
sample_weight = numpy.sqrt(numpy.minimum(support, support_cap))
model.fit(Z, sample_weight=sample_weight)
labels = model.labels_
```

Assign low-support patterns through the backoff chain after clustering.

Reserve dedicated IDs for `BOS`, `EOS`, and `UNKNOWN`; do not allow KMeans to place them in ordinary buckets.

## 8. Score a Candidate Bucket Mapping

For every bucket, aggregate its members' training counts and estimate a smoothed context distribution:

```text
Q_bucket(context) = P(context | bucket)
```

Measure development reconstruction loss:

```text
loss = -sum over development events log Q_bucket(x)(observed_context)
```

Calculate this independently for left and right mappings. Report:

```text
total development loss
average loss per transition
loss per bucket
loss per feature pattern
bucket support
number of members per bucket
within-bucket distance to centroid
```

Also run each configuration with several random seeds and record Adjusted Rand Index between assignments. Prefer the smallest bucket count near the best development-loss plateau that also has stable assignments and adequately supported buckets.

Do not select a model using KMeans inertia alone. Inertia measures fit to the training vectors, not generalization to unseen contexts.

## 9. Split Broad Buckets

Rank split candidates using:

```text
high development reconstruction loss
high within-bucket distance
large membership count
evidence of two or more stable subgroups
```

For each candidate:

1. Extract only the bucket's training vectors.
2. Run local `KMeans(n_clusters=2)` with multiple initializations.
3. Re-estimate the two bucket profiles from training counts.
4. Recompute total development loss.
5. Accept the split only if it improves the penalized objective and both children meet minimum support.

Use:

```text
objective = development_loss + lambda_bucket * number_of_buckets
```

Record the members, support, and objective change for every accepted or rejected proposal.

## 10. Merge Redundant Buckets

Generate merge candidates from pairs with similar training profiles or centroids. Use cosine similarity for candidate generation and development loss for the decision.

For each candidate pair:

1. Combine their training counts.
2. Estimate the merged profile.
3. Recompute total development loss.
4. Accept the merge when the loss increase is smaller than the saved bucket penalty.

When a fixed bucket count is required, perform one accepted merge followed by one accepted split. This reallocates a bucket from a redundant distinction to an under-modeled distinction.

Repeat split and merge passes until a full pass produces no accepted proposal.

## 11. Reassign Misplaced Patterns

After split/merge convergence, run hard reassignment passes.

For each sufficiently supported pattern:

1. Temporarily remove its counts from its current bucket profile.
2. Score its training behavior against every candidate bucket profile.
3. Propose the lowest-loss bucket, subject to minimum-support and coarse grammatical constraints.
4. Accept the move only if the global development objective improves.
5. Re-estimate both affected profiles.

Use leave-one-pattern-out profiles while proposing moves so a frequent pattern does not make its current bucket look artificially perfect.

Stop when a complete pass accepts no moves or after a configured maximum number of passes.

## 12. Add Lexical Exceptions

Evaluate frequent lemmas or surfaces against their default grammatical-pattern bucket. A lexical item may receive its own assignment only when:

```text
its support exceeds the strong-support threshold
its behavior differs consistently from its parent pattern
the difference appears across multiple documents
the exception improves the development objective
```

Represent exceptions as an overlay rather than modifying the base feature schema:

```text
default_bucket[feature_pattern]
exception_bucket[(lemma_or_surface, feature_pattern)]
```

Re-run split, merge, and reassignment checks after adding accepted exceptions.

## 13. Stabilize and Export IDs

KMeans label numbers are arbitrary. Canonicalize them before export:

1. Assign reserved IDs first: `BOS`, `EOS`, `UNKNOWN`.
2. For each learned bucket, sort its member pattern keys.
3. Build a stable bucket signature from the sorted members and centroid/profile.
4. Sort buckets by signature.
5. Assign consecutive integer IDs in that order.

Export, separately for left and right:

```text
bucket ID
member feature patterns
lexical exceptions
backoff assignments
training support
development loss
top context features
centroid or probability profile
training configuration and random seed
```

Save the fitted `DictVectorizer`, optional `TruncatedSVD`, clustering model, schema, and exact row ordering so the result can be reproduced and inspected.

## 14. Bucket-Only Validation

The bucket build is complete when all checks pass:

- Every dictionary entry resolves to exactly one left ID and one right ID.
- Reserved boundary and unknown patterns have dedicated IDs.
- No learned bucket is empty.
- No matrix, vector, centroid, or profile contains `NaN` or infinity.
- Re-running with the same corpus, configuration, and seed produces byte-equivalent mappings.
- Left and right directionality tests pass.
- Rare and unseen patterns follow the declared backoff chain.
- Accepted splits, merges, moves, and exceptions improve the recorded development objective.
- Final test reconstruction loss is reported once without further tuning.
