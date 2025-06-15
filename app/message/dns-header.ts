import { writeAsBigEndian } from '../utils/dns-utils';

export interface HeaderObject {
    id: number;
    isResponse: boolean;
    opCode: number;
    authoritativeAnswer: boolean;
    truncated: boolean;
    recursionDesired: boolean;
    recursionAvailable: boolean;
    reserved: number;
    rCode: number;
    questionCount: number;
    answerCount: number;
    authorityCount: number;
    additionalCount: number;
}

export class DnsMessageHeader {
    private headerObj: HeaderObject;

    constructor(buffer: Buffer) {
        this.headerObj = this.decode(buffer);
    }

    get data() {
        return this.headerObj;
    }

    decode(buffer: Buffer): HeaderObject {
        const id = buffer.readUInt16BE(0);
        const isResponse = (buffer[2] & 0b10000000) !== 0;
        const opCode = (buffer[2] >> 3) & 0b00001111;
        const authoritativeAnswer = (buffer[2] & 0b00000100) !== 0;
        const truncated = (buffer[2] & 0b00000010) !== 0;
        const recursionDesired = (buffer[2] & 0b00000001) !== 0;
        const recursionAvailable = (buffer[3] & 0b10000000) !== 0;
        const reserved = (buffer[3] >> 4) & 0b00000111;
        const rCode = buffer[3] & 0b00001111;
        const questionCount = buffer.readUInt16BE(4);
        const answerCount = buffer.readUInt16BE(6);
        const authorityCount = buffer.readUInt16BE(8);
        const additionalCount = buffer.readUInt16BE(10);


        return {
            id,
            isResponse,
            opCode,
            authoritativeAnswer,
            truncated,
            recursionDesired,
            recursionAvailable,
            reserved,
            rCode,
            questionCount,
            answerCount,
            authorityCount,
            additionalCount,
        }
    }

    encode() {
        const byteArray = new Uint8Array(12);
        const sourceHeaderObj = this.headerObj;
        writeAsBigEndian(sourceHeaderObj.id, byteArray, 0);
        let byte = 0;
        if (sourceHeaderObj.isResponse) byte |= 0b10000000;
        byte |= sourceHeaderObj.opCode << 3;
        if (sourceHeaderObj.authoritativeAnswer) byte |= 0b00000100;
        if (sourceHeaderObj.truncated) byte |= 0b00000010;
        if (sourceHeaderObj.recursionDesired) byte |= 0b00000001;
        byteArray[2] = byte;

        byte = 0;
        if (sourceHeaderObj.recursionAvailable) byte | 0b10000000;
        byte |= sourceHeaderObj.rCode;
        byteArray[3] = byte;

        writeAsBigEndian(sourceHeaderObj.questionCount, byteArray, 4);
        writeAsBigEndian(sourceHeaderObj.answerCount, byteArray, 6);
        writeAsBigEndian(sourceHeaderObj.authorityCount, byteArray, 8);
        writeAsBigEndian(sourceHeaderObj.additionalCount, byteArray, 10);

        return byteArray;
    }
}