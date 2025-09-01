const WebSocket = require('ws')
const queData = require('../public/que.json');

const wss = new WebSocket.Server({ port: '8082' });

const database = {}
const setting = { state: 0, currQue: 0, time: null }
const ansDefault = [0, 0]
let nextUser = 1

let adminCilent = null;
const password = "rutik@#1971";

function getUserState() {
    return { state: "waiting" }
}


wss.on('connection', ws => {
    console.log('Cilent connected : ');

    function serverSend(obj) {
        ws.send(JSON.stringify(obj));
    }

    function adminSend(obj) {
        if (adminCilent && adminCilent.readyState === adminCilent.OPEN) {
            adminCilent.send(JSON.stringify(obj));
        }
    }

    function cilentSend(obj) {
        for (let userID in database) {
            adminSend(obj)
            const cilentSocket = database[userID]['client']
            if (cilentSocket && cilentSocket.readyState === cilentSocket.OPEN) {
                database[userID]['client'].send(JSON.stringify(obj))
            }
        }
    }

    function generateUserList() {
        let currUsers = []
        for (let userID in database) {
            currUsers.push(database[userID].n);
        }
        return currUsers
    }
    function sendState() {
        cilentSend({ m: 5, d: setting['state'], d2: setting['currQue'] })
    }
    function setState(st) {
        setting['state'] = st;
        sendState();
    }

    ws.on("message", msg => {
        msg = JSON.parse(msg);
        console.log(database.keys)
        if (msg.m == 1) {
            // Send User State ELSE no user found
            const userID = msg.d
            if (database[userID]) {
                database[userID]['cilent'] = ws;
                // serverSend({ m: 1, d: getUserState(msg.d), s: 1 });
                sendState()
            } else {
                serverSend({ m: 1, s: 0 });
            }
        }
        else if (msg.m == 2) {
            // Create a new user with name in database
            const userID = `u${nextUser}`;
            database[userID] = { n: msg.d, client: ws, ans: ansDefault };
            nextUser = nextUser + 1;
            serverSend({ m: 2, d: { n: msg.d, id: userID }, s: 1 });
            adminSend({ m: 3, d: generateUserList() })
        }
        else if (msg.m == 3) {
            // Admin CIlent Setter
            if (msg.d == password) {
                adminCilent = ws;
                adminSend({ m: 3, d: generateUserList() })
            }
        }
        else if (msg.m == 4) {
            // Trigger Start Que Event [Can Only Trigger by one user Admin]
            setting.time = queData[setting.currQue].t;

            // Game State Updater message
            setState(1)
            countdownInterval = setInterval(() => {
                setting.time = setting.time - 1;
                // Counter Time updater message
                cilentSend({ m: 4, d: setting.time, s: 1 });

                if (setting.time <= 0) {
                    clearTimeout(countdownInterval)
                    const answerObj = {}
                    for (let userID in database) {
                        // answerObj[userID] = database[userID]["a"][setting['currQue']];
                    }
                    // SEND ANSWERS
                    adminSend({ m: 6, d: answerObj })
                    // Change State Message
                    setState(0)
                }
            }, 1000)
        }
        else if (msg.m == 7) {
            // QUESTION COUNTER INCREMENTER
            setting['currQue']++;
            console.log(setting['currQue'])
        }
        else if (msg.m == 8) {
            // ANSWER UPDATER
            database[msg.d.id]['ans'][msg.d.q] = msg.d.a;
            console.log(`${database[msg.d.id]['n']} selected option ${msg.d.a} for que ${msg.d.q}`);
        }
    })

    ws.on('close', () => {
        console.log('Cilent disconnected : ');
    })
})