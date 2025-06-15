export class DnsProvider {
    private map = new Map<string, string>();

    getDomainIp(domain: string) {
        return this.map.get(domain);
    }

    setDomainIp(domain: string, ip: string) {
        this.map.set(domain, ip);
    }
}
