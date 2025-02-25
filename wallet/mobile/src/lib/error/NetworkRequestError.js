import { AppError } from '@/app/lib/error';

export class NetworkRequestError extends AppError {
    constructor(status, code, message) {
        super(code, message);
        this.name = this.constructor.name;
        this.status = status;
    }
}
