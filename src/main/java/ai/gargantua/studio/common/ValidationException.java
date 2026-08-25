package ai.gargantua.studio.common;

/** The request was malformed or violates a manifest invariant — maps to HTTP 400. */
public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message);
    }
}
