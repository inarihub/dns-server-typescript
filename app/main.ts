import * as dgram from 'dgram';
import { DnsMessage } from './message/dns-message';
import { addressArgs } from './process/resolver-args';

export interface DnsQuestionObj {
    name: string;
    type: number;
    class: number;
}

export interface DnsAnswerObj extends DnsQuestionObj {
    ttl: number;
    data: string;
}

const udpSocket: dgram.Socket = dgram.createSocket('udp4');
udpSocket.bind(2053, '127.0.0.1');

udpSocket.on('message', async (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
    try {
        const dnsMessage = new DnsMessage(data);

        const answers = await Promise.all(dnsMessage.questionSection.map(question => {
            const newMessage = new DnsMessage(Buffer.from(data));
            newMessage.setQuestion([question]);
            return forwardQuestion(newMessage.getQuestionMessage());
        }));

        if (answers.length !== dnsMessage.questionSection.length) {
            throw new Error("No answers");
        }

        dnsMessage.setAnswers(answers.filter(answer => answer !== undefined));
        const response = dnsMessage.getResponse();
        udpSocket.send(response, remoteAddr.port, remoteAddr.address);
    } catch (e) {
        console.log(`Error sending data: ${e}`);
    }
});

async function forwardQuestion(message: Buffer) {
    return new Promise<DnsAnswerObj>((resolve, reject) => {
        const forwardSocket = dgram.createSocket('udp4');

        if (!addressArgs) {
            throw new Error("No address args");
        }

        forwardSocket.send(message, Number(addressArgs.port), addressArgs.ip);
        forwardSocket.on('message', (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
            console.log("Received response from", remoteAddr.address, remoteAddr.port, "data", data);

            if (data.length < 12) {
                reject(new Error("Invalid response"));
            }

            const { answers } = new DnsMessage(data);
            resolve(answers[0]);
        });
        forwardSocket.on('error', (err) => {
            reject(err);
        });
    });
}

process.on('SIGINT', () => {
    process.exit(0);
});