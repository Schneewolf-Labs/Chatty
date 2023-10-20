class ResponseHistory {
    constructor(persona) {
        this.persona = persona;
        this._history = [];
        this.lastResponseID = 0;
    }

    addResponse(response) {
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

    getHistory(numResponses) {
        if (!numResponses) numResponses = this._history.length;
        const history = [];
        // iterate through the history backwards until we have desired number of responses
        for (let i = this.lastResponseID; i >= 0 && history.length < numResponses; i--) {
            const response = this._history[i];
            if (response) history.push(response);
        }
        return history;
    }

    getResponse(id) {
        return this._history[id];
    }

    setLastResponseID(id) {
        if (typeof id !== 'number' || id < 0) {
            throw new Error("Invalid response ID");
        }
        this.lastResponseID = id;
    }
}

module.exports = ResponseHistory;