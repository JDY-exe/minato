
# Top-Level Plan: MeCab-Style Japanese Morphological Analyzer

## Goal

Build a MeCab/Sudachi-style Japanese morphological analyzer from scratch, with a special focus on automatically learning left/right context buckets from an annotated corpus.

The analyzer will use:

- dictionary candidates
- a lattice
- Viterbi decoding
- word costs
- left/right context IDs
- a connection-cost matrix


total_cost =
  sum(word_cost)
+ sum(connection_cost(previous.right_id, current.left_id))


## Phase 1: Research Prototype in Python

Use Python for fast experimentation.

Build scripts for:

* reading an annotated Japanese corpus
* extracting dictionary-style feature patterns
* counting immediate left/right neighbor behavior
* learning left/right context buckets
* training simple word and connection costs
* evaluating tokenization and POS accuracy

Recommended tools:

* Python
* NumPy
* SciPy
* scikit-learn
* pandas or polars
* tqdm

## Phase 2: Feature Pattern Design

Start by clustering feature patterns, not raw words.

Example feature patterns:

```txt
名詞,普通名詞,一般
名詞,固有名詞,人名
助詞,格助詞,を
助詞,係助詞,は
動詞,五段-ラ行,連用形
動詞,五段-ラ行,連用タ接続
助動詞,タ,終止形
補助記号,句点
```

Avoid clustering raw surfaces first, because that can create semantic topic clusters instead of grammar-useful clusters.

## Phase 3: Learn Left and Right Buckets

Learn two separate mappings:

```txt
left_bucket(feature_pattern)
right_bucket(feature_pattern)
```

Use gold corpus transitions to build:

```txt
left_behavior[x]  = distribution of things appearing before x
right_behavior[x] = distribution of things appearing after x
```

Then cluster left and right behavior separately.

Useful first methods:

* sparse count vectors
* smoothed neighbor distributions
* TruncatedSVD
* k-means
* agglomerative clustering
* Jensen-Shannon or cosine distance

## Phase 4: Train Initial Costs

Given bucket assignments, train:

```txt
word_cost(entry)
connection_cost(previous.right_id, current.left_id)
```

Start with simple count-based costs:

```txt
word_cost(entry) ≈ -log P(entry)
connection_cost(r, l) ≈ -log P(l | r)
```

Later, upgrade to:

* structured perceptron
* margin-based training
* CRF-style training

## Phase 5: Build a Tiny Python Viterbi Decoder

Before optimizing, build a minimal decoder in Python.

It should:

* build a lattice from dictionary candidates
* add unknown-word candidates
* apply word costs
* apply connection costs
* run Viterbi
* output the best token sequence

This proves that the learned buckets and costs actually work.

## Phase 6: Evaluate Bucket Quality

Evaluate at three levels:

1. **Cluster sanity**

   * print bucket members
   * inspect common previous/next neighbors

2. **Transition prediction**

   * held-out transition likelihood
   * next/previous neighbor prediction

3. **Full tokenizer accuracy**

   * boundary precision/recall/F1
   * POS accuracy
   * unknown-word accuracy
   * sentence-level exact match
   * matrix size
   * decoding speed

## Phase 7: Add Supervised Split/Merge

Use the gold corpus and dev accuracy to refine buckets automatically.

Loop:


1. train costs
2. run Viterbi
3. evaluate errors
4. propose bucket splits
5. propose bucket merges
6. accept changes that improve score
7. repeat


Use an objective like:

```txt
score = dev_error + λ * model_size
```

This prevents the model from creating too many tiny buckets.

## Phase 8: Handle Rare and Unknown Words

Use a backoff chain:

exact surface/entry
→ lemma + POS + conjugation form
→ full feature pattern
→ POS + subPOS
→ POS
→ unknown class


Unknown classes:

```txt
UNK_KANJI
UNK_KATAKANA
UNK_HIRAGANA
UNK_NUMBER
UNK_ALPHA
UNK_SYMBOL
```

## Phase 9: Build the Fast Runtime in Rust

Once the Python prototype works, implement the production tokenizer in Rust.

Rust components:

* dictionary lookup
* double-array trie or FST
* unknown-word generator
* lattice builder
* Viterbi decoder
* connection matrix lookup
* binary dictionary format
* CLI

Core lookup:

```rust
connection_cost =
    matrix[previous.right_id][current.left_id]
```

## Phase 10: Add Python Bindings and Tooling

Expose the Rust tokenizer to Python using:

* PyO3
* maturin

Use Python for:

* evaluation
* notebooks
* bucket inspection
* dictionary building
* error analysis

Optional TypeScript tools:

* web demo
* lattice visualizer
* dictionary inspector

## Recommended Stack

Research/training:
  Python, NumPy, SciPy, scikit-learn, pandas/polars

Runtime:
  Rust

Python bindings:
  PyO3, maturin

Visualization/demo:
  TypeScript, React, D3 or canvas


## First Milestone

Build a small end-to-end prototype:

```txt
gold corpus
→ feature patterns
→ left/right neighbor counts
→ learned buckets
→ count-based costs
→ tiny Viterbi decoder
→ evaluation report
```

The goal of the first milestone is not speed. The goal is to prove that automatically learned context buckets improve tokenization accuracy over very coarse hand-seeded buckets.

```
```
