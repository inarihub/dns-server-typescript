import { ZERO_BYTE } from '../message/dns-message';

export function encodeBigEndian(value: number | number[], bytes: number = 2) {
    const result: number[] = [];

    if (typeof value === 'number') {
        for (let i = bytes - 1; i >= 0; i--) {
            result.push((value >> (8 * i)) & 0xFF);
        }
    } else {
        result.push(...value);
    }

    return result;
}

export function writeAsBigEndian(value: number, array: Uint8Array, index: number) {
    if (index + 1 >= array.length) {
        throw new Error('Index out of bounds');
    }

    const [highByte, lowByte] = encodeBigEndian(value);
    array[index] = highByte;
    array[index + 1] = lowByte;
}

export function encodeIntoLabel(label: string) {
    return label.split('.').map(node => {
        const charCodes = node.split('').map(char => char.charCodeAt(0));
        return [node.length, ...charCodes];
    }).flat().concat(ZERO_BYTE);
}