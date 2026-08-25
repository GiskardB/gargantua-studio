package ai.gargantua.studio.common;

/**
 * The Control Plane could not be reached or answered with an error — maps to HTTP 502.
 * The Studio UI treats this as "platform data unavailable" and may fall back to a
 * read-only offline view.
 */
public class UpstreamException extends RuntimeException {
    public UpstreamException(String message, Throwable cause) {
        super(message, cause);
    }
}
