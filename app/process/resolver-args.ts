const argv = process.argv;
let addressArgs: { ip: string, port: string } | undefined;
const resolverArgs = argv.indexOf("--resolver");

if (resolverArgs !== -1 && argv[resolverArgs + 1]) {
    const [ip, port] = argv[resolverArgs + 1].split(":");
    addressArgs = { ip, port };
    console.log("IP:", addressArgs.ip, "Port:", addressArgs.port);
} else {
    console.error("Missing or invalid --resolver argument");
}

export { addressArgs };
