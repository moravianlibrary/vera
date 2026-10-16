# Generating a list

How a List generator plugin drafts a list ([ENT-list](../model/entities.md#ent-list)).

#### PLAN-generate

*Generate* asks an enabled List generator instance for a draft:
- the pages wanted;
- the intention that shapes it: Overall unless another running or upcoming, unarchived one is
  picked;
- optionally, the top categories to keep to;
- for a correcting run, the pages for each category.

The result is a draft to edit, never saved by itself.

#### PLAN-generate-pool

The generator chooses only from the pool ([LC-LIST-pool](../lifecycles/list.md#lc-list-pool)),
narrowed to the shaping intention's scope ([PLAN-scope](intentions.md#plan-scope)). Items with
no page count are left out.
Members already on the draft stay; the generator tops up.

#### PLAN-generate-mix

With a mix, the generator fills each leaf's share of the pages, highest priority first, then the
oldest ask. It never splits a document, and it allows a small slack over a leaf's goal (its
configured tolerance, 5% by default). A share it cannot fill is **shortfall**:
- it is spread to the nearest categories that still have items, never into one at 0%;
- it is reported with the reason.

#### PLAN-generate-correcting

A correcting run fixes the pages for each category the mix is read across, split below by the
shares. What it cannot fill stays short there and is not spread elsewhere.

#### PLAN-generate-no-mix

Without a mix, the generator takes items in priority and request-age order up to the pages
wanted, with no split between categories. A correcting allocation needs a mix.

#### PLAN-generate-provenance

A list made from a draft records the generator and its version, the intention, the mix and its
revision, the pages asked and any allocation. It is logged as *Generated*.

*Why:* for an AI-based generator, the record is the only way to say afterwards why a list looks
the way it does.

#### PLAN-generator-classes

A generator is **rule-based** or **AI-based**. Both answer with the same kind of draft; an
AI-based one gives its reasons in its own words.
