package cz.mzk.vera.iterations;

// ACT-cancel: resolve the list name placed in the cancellation event while list storage is pending.
public interface IterationListNames {
    String nameOf(String listId);
}
