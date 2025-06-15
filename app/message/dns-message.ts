import type { DnsAnswerObj, DnsQuestionObj } from '../main';
import { encodeBigEndian, encodeIntoLabel } from '../utils/dns-utils';
import { DnsMessageHeader } from './dns-header';

export type ByteIndex = number;

interface LabelDecodeResult {
    label: string;
    endIndex: ByteIndex;
}

export const ZERO_BYTE = 0x00;
export const POINTER_BYTE = 0xC0;

export class DnsMessage {
    public header: DnsMessageHeader;
    private sourceQuestionBuffer: Buffer;
    private sourceAnswerBuffer: Buffer;
    public answers: DnsAnswerObj[] = [];
    public questionSection: DnsQuestionObj[];

    constructor(
        data: Buffer,
    ) {
        this.header = new DnsMessageHeader(data);
        const { source, questions } = this.decodeQuestion(data);
        this.header.data.questionCount = questions.length;
        this.sourceQuestionBuffer = source;
        this.questionSection = questions;
        const { source: answerSource, answers } = this.decodeAnswer(data);
        this.header.data.answerCount = answers.length;
        this.sourceAnswerBuffer = answerSource;
        this.answers = answers;
    }

    getQuestionMessage() {
        return Buffer.concat([this.header.encode(), this.sourceQuestionBuffer]);
    }

    getResponse() {
        this.formResponseHeaders();
        return Buffer.concat([this.header.encode(), this.sourceQuestionBuffer, this.sourceAnswerBuffer]);
    }

    setAnswers(answers: DnsAnswerObj[]) {
        this.answers = answers;
        this.header.data.answerCount = answers.length;
        this.sourceAnswerBuffer = this.writeAnswerSection(answers);
    }

    setQuestion(questions: DnsQuestionObj[]) {
        this.questionSection = questions;
        this.header.data.questionCount = questions.length;
        this.sourceQuestionBuffer = this.writeQuestionSection(questions);
    }

    private formResponseHeaders() {
        this.header.data.isResponse = true;
        this.header.data.authoritativeAnswer = false;
        this.header.data.authorityCount = 0;
        this.header.data.additionalCount = 0;
        this.header.data.truncated = false;
        this.header.data.recursionAvailable = false;
        this.header.data.rCode = this.header.data.opCode === 0 ? 0 : 4;
        this.header.data.answerCount = this.answers.length;
        this.header.data.questionCount = this.questionSection.length;
    }

    private decodeQuestion(buffer: Buffer) {
        const results: DnsQuestionObj[] = [];
        let index = 12;

        for (let i = 0; i < this.header.data.questionCount; i++) {
            if (index >= buffer.length) {
                throw new Error('Invalid question length');
            }

            const { label, endIndex: labelIndex } = this.decodeIntoLabel(buffer, index);
            const type = buffer.readUInt16BE(labelIndex + 1);
            const classType = buffer.readUInt16BE(labelIndex + 3);
            index = labelIndex + 5;

            results.push({ name: label, type, class: classType });
        }

        return {
            source: buffer.subarray(12, index),
            questions: results,
        }
    }

    private decodeAnswer(buffer: Buffer) {
        const results: DnsAnswerObj[] = [];
        let index = 12 + this.sourceQuestionBuffer.length;

        for (let i = 0; i < this.header.data.answerCount; i++) {
            const { label, endIndex: labelIndex } = this.decodeIntoLabel(buffer, index);
            const type = buffer.readUInt16BE(labelIndex + 1);
            const classType = buffer.readUInt16BE(labelIndex + 3);
            //const ttl = buffer.readUInt32BE(labelIndex + 5);
            const dataLength = buffer.readUInt16BE(labelIndex + 9);
            const dataStart = labelIndex + 11;
            const dataEnd = dataStart + dataLength;

            let data: string;
            if (type === 1) {
                data = Array.from(buffer.subarray(dataStart, dataEnd))
                    .map(byte => byte.toString())
                    .join('.');
            } else {
                data = buffer.subarray(dataStart, dataEnd).toString();
            }

            index = dataEnd;

            results.push({ name: label, type, class: classType, ttl: 0, data });
        }

        return {
            source: buffer.subarray(12 + this.sourceQuestionBuffer.length, index),
            answers: results,
        }
    }

    private isPointer(byte: number) {
        return (byte & 0b11000000) === 0b11000000;
    }

    private getPointerIndex(buffer: Buffer, index: ByteIndex) {
        return buffer[index] & 0b00111111;
    }

    private getLabelByPointer(buffer: Buffer, index: ByteIndex) {
        let currentIndex = index;
        const isPointer = this.isPointer(buffer[currentIndex]);

        if (isPointer) {
            currentIndex++;

            const indexByPointer = this.getPointerIndex(buffer, currentIndex);
            const { label } = this.decodeIntoLabel(buffer, indexByPointer);

            return label;
        }
    }


    private decodeIntoLabel(buffer: Buffer, startIndex: ByteIndex): LabelDecodeResult {
        let currentIndex = startIndex;
        let labels = [];
        let currentPointer = buffer[currentIndex];

        while (currentPointer !== ZERO_BYTE) {
            const labelByPointer = this.getLabelByPointer(buffer, currentIndex);

            if (labelByPointer) {
                labels.push(labelByPointer);
                currentIndex++;

                return {
                    label: labels.join('.'),
                    endIndex: currentIndex,
                };
            }

            currentIndex++;

            if (currentIndex >= buffer.length) {
                throw new Error(`Invalid label: ${labels.join('.')} at index ${currentIndex} of ${buffer.length}`);
            }

            const label = this.readLabel(buffer, currentIndex, currentIndex + currentPointer);
            labels.push(label);
            currentIndex += currentPointer;
            currentPointer = buffer[currentIndex];
        }

        const result: LabelDecodeResult = {
            label: labels.join('.'),
            endIndex: currentIndex,
        };

        return result;
    }

    private readLabel(buffer: Buffer, from: number, to: number) {
        return buffer.subarray(from, to).toString('utf-8');
    }

    private writeQuestionSection(questions: DnsQuestionObj[]) {
        this.header.data.questionCount = questions.length;

        return Buffer.from(questions.map(question => {
            return [
                ...encodeIntoLabel(question.name),
                ...encodeBigEndian(question.type),
                ...encodeBigEndian(question.class),
            ]
        }).flat());
    }

    private writeAnswerSection(answers: DnsAnswerObj[]) {
        return Buffer.from(answers.map(a => {
            const ipOctets = a.data.split('.').map(Number);

            return [
                ...encodeIntoLabel(a.name),
                ...encodeBigEndian(a.type),
                ...encodeBigEndian(a.class),
                ...encodeBigEndian(a.ttl, 4),
                ...encodeBigEndian(ipOctets.length),
                ...encodeBigEndian(ipOctets),
            ];
        }).flat());
    }
}
