import { EventEmitter } from 'events';

export class EventController {
	/**
	 * Constructs a new EventController instance.
	 *
	 */
	constructor() {
		this._notificationChannel = new EventEmitter();
	}
	
	/**
	 * Subscribe to the controller events
	 * @param {string} eventName - event name
	 * @param {Function} listener - callback function
	 * @returns {void}
	 */
	on = (eventName, listener) => {
		this._notificationChannel.on(eventName, listener);
	};

	/**
	 * Unsubscribe from the controller events
	 * @param {string} eventName - event name
	 * @param {Function} listener - callback function
	 * @returns {void}
	 */
	removeListener = (eventName, listener) => {
		this._notificationChannel.removeListener(eventName, listener);
	};

	/**
	 * Emit controller event
	 * @param {string} eventName - event name
	 * @param {object} payload - event payload
	 * @returns {void}
	 * @private
	 */
	emit = (eventName, payload) => {
		this._notificationChannel.emit(eventName, payload);
	};
}
