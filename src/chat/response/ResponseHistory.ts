interface Persona {
    name: string;
    [key: string]: any;
}

class ResponseHistory {
    private persona: Persona;
    private _history: string[];
    public lastResponseID: number;

    constructor(persona: Persona) {
        this.persona = persona;
        this._history = [];
        this.lastResponseID = 0;
    }

    addResponse(response: string): void {
        // Add response to response history
        let prevResponse = this._history[this.lastResponseID];
        if (prevResponse) {
            prevResponse += ` ${response}`;
        } else {
            prevResponse = response;
        }
        this._history[this.lastResponseID] = prevResponse;
    }

    addEvent(event: string): void {
        event = `*${this.persona.name} ${event}*`
        const response = this._history[this.lastResponseID];
        if (response) {
            this._history[this.lastResponseID] = `${response}\n${event}\n`;
        } else {
            this._history[this.lastResponseID] = event;
        }
    }

    getHistory(numResponses?: number): string[] {
        if (!numResponses) numResponses = this._history.length;
        const history = [];
        // iterate through the history backwards until we have desired number of responses
        for (let i = this.lastResponseID; i >= 0 && history.length < numResponses; i--) {
            const response = this._history[i];
            if (response) history.push(response);
        }
        return history;
    }

    getResponse(id: number): string | undefined {
        return this._history[id];
    }

    setLastResponseID(id: number): void {
        if (typeof id !== 'number' || id < 0 || isNaN(id)) {
            throw new Error("Invalid response ID");
        }
        this.lastResponseID = id;
    }
}

export default ResponseHistory;