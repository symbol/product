const webSocketClient = {
	create(url) {
		return {
			url: url.replace('http', 'ws') + '/ws',
			webSocket: null,
			subscribers: {},
			uid: '',
			open() {
				return new Promise((resolve, reject) => {
					if (null === this.webSocket || this.webSocket.readyState === WebSocket.CLOSED) {
						this.webSocket = new WebSocket(this.url);

						this.webSocket.onopen = () => {};

						this.webSocket.onerror = err => {
							reject(err);
						};

						this.webSocket.onclose = event => {
							this.webSocket = null;
						};

						this.webSocket.onmessage = event => {
							const parsedMessage = JSON.parse(event.data);
							if ('uid' in parsedMessage) {
								this.uid = parsedMessage.uid;
								resolve();
							}

							// Handle websocket message
							const { topic, data } = parsedMessage;

							if (this.subscribers[topic])
								this.subscribers[topic](data);

						};
					} else {
						resolve();
					}
				});
			},
			close() {
				if (this.webSocket &&
					(this.webSocket.readyState === WebSocket.OPEN || this.webSocket.readyState === WebSocket.CONNECTING))
					this.webSocket.close();

			},
			subscribeTo(channel) {
				const subscriptionMessage = {
					uid: this.uid,
					subscribe: channel
				};
				this.webSocket.send(JSON.stringify(subscriptionMessage));
			}
		};
	}
};

export default webSocketClient;
