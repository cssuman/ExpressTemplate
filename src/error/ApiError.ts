/**
 * The single error type this application throws on purpose.
 *
 * Every field exists so the client gets an answer to a different question:
 * - `statusCode` - what HTTP status should the transport carry?
 * - `errorCode`  - a stable machine-readable code clients can branch on (E004)
 * - `message`    - what went wrong, in the caller's language
 * - `details`    - why it went wrong
 * - `suggestion` - what the caller should do next
 *
 * `isOperational` separates *expected* failures (bad input, missing auth, rate
 * limit) from *bugs* (undefined is not a function). Operational errors are
 * normal and get a clean response; non-operational ones indicate the process
 * may be in an unknown state and deserve an alert.
 *
 * @see docs/07-error-handling.md
 */
export class ApiError extends Error {
    readonly statusCode: number;
    readonly errorCode: string;
    readonly details: string;
    readonly suggestion: string;
    readonly timestamp: Date;
    readonly isOperational: boolean;

    constructor(statusCode: number, errorCode: string, message: string, details: string, suggestion: string, isOperational = true) {
        super(message);

        this.name = this.constructor.name;

        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.suggestion = suggestion;
        this.isOperational = isOperational;
        this.timestamp = new Date();

        // Keep the constructor frame out of the stack trace.
        Error.captureStackTrace(this, this.constructor);
    }
}
