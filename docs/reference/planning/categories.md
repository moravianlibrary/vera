# Categories

The tree of lines of work ([ENT-category](../model/entities.md#ent-category)). Custody on it is in
[custody](../access/custody.md#category-custody); shares on it are in [mixes](mixes.md).

#### PLAN-tree

Categories form one tree. Items are classified only on leaves
([REL-iteration-category](../model/relationships.md#rel-iteration-category)).

#### PLAN-leaf-with-documents

A leaf that holds documents cannot take a child: the documents would no longer sit on a leaf.
To split it, **refine** it.

#### PLAN-refine

Refining a leaf makes its first child:
- every document on the leaf moves into the child, each move logged as a reclassification;
- in every mix that gives the leaf a share, the child takes all of it;
- custody on the leaf still reaches the documents.

*Why:* the child holds everything that was there. With no share, the branch would drop out of
generation.

#### PLAN-name

Names are unique among siblings.

#### PLAN-move

A category moves with its whole subtree. In its new set of siblings it starts with no share;
where it was, its share becomes unallocated. Every mix that changes moves to a new revision, so
an editor opened on the old set is refused rather than writing it back.

#### PLAN-delete

Only an empty leaf is deleted:
- it has no children;
- it holds no documents (reclassify them first);
- no intention or repeat is scoped to it.

Its share in every mix becomes unallocated, and custody granted on it goes with it.

#### PLAN-top-level

At `custody`, a person changes the tree only inside their own subtree. Only `category.edit@any`
changes the top level.

#### PLAN-new-category-share

A new or moved category gets no share in any mix, so its set is flagged until somebody decides.

*Why:* 0% would leave it out of planning without anyone deciding so. Likewise a delete never
widens or archives the intentions scoped to it: their scope is a planning decision, changed by
hand first.
