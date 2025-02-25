export class AppError extends Error {
    constructor(code, message) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}
