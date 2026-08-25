package ai.gargantua.studio.common;

import java.time.Instant;

/**
 * Uniform error body returned for every failed request, so the Studio UI can render
 * one shape regardless of which layer failed.
 *
 * @param status    HTTP status code
 * @param error     HTTP reason phrase
 * @param message   human-readable detail
 * @param path      request path that produced the error
 * @param timestamp when the error was produced
 */
public record ApiError(
        int status,
        String error,
        String message,
        String path,
        Instant timestamp) {
}
