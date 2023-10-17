class ResponseHistory {
    constructor(persona) {
        this.persona = persona;
        this._history = [];
        this.lastResponseID = 0;
    }

    addResponse(response) {
        this._history.push(response);
        // Add response to response history
        let prevResponse = this._history[this.lastResponseID];
        if (prevResponse) {
            prevResponse += ` ${response}`;
        } else {
            prevResponse = response;
        }
        this._history[this.lastResponseID] = prevResponse;
    }

    addEvent(event) {
        event = `*${this.persona.name} ${event}*`
        const response = this._history[this.lastResponseID];
        if (response) {
            this._history[this.lastResponseID] = `${response}\n${event}\n`;
        } else {
            this._history[this.lastResponseID] = event;
        }
    }

    getResponse(id) {
        return this._history[id];
    }
}

module.exports = ResponseHistory;