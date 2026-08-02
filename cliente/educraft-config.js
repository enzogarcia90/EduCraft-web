(function () {
	var localHosts = { "localhost": true, "127.0.0.1": true, "0.0.0.0": true };
	window.EDUCRAFT_API_BASE_URL = localHosts[location.hostname] ? "http://127.0.0.1:8080" : "https://educraftes.duckdns.org";
})();
