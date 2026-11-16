'use strict';
import { popen, readfile, writefile, mkdir } from 'fs';
import { cursor } from 'uci';

const DIR = '/tmp/bwdash';
const SETS = { up4: 'up', dn4: 'down', up6: 'up', dn6: 'down' };
let st = null;

function sh(cmd) {
	let p = popen(cmd + ' 2>/dev/null'), o = '';
	if (p) { o = p.read('all'); p.close(); }
	return o;
}
function dbpath() { return cursor().get('bwdash', 'config', 'db') || DIR + '/db.json'; }
function dayKey(t) { let d = localtime(t); return sprintf('%04d-%02d-%02d', d.year, d.mon, d.mday); }

function load() {
	if (st) return;
	try { st = json(readfile(dbpath())); } catch (e) { st = null; }
	if (type(st) != 'object') st = {};
	st.clients = st.clients || {};
	st.daily = st.daily || {};
	st.last = st.last || {};
	st.since = st.since || time();
	st.ts = 0;
}
function save() { mkdir(DIR); writefile(dbpath(), sprintf('%J', st)); }

function neigh() {
	let m = {};
	for (let l in split(readfile('/proc/net/arp') || '', '\n')) {
		let f = split(trim(l), /\s+/);
		if (length(f) >= 6 && f[2] != '0x0' && f[0] != 'IP address') m[f[0]] = lc(f[3]);
	}
	for (let l in split(sh('ip -6 neigh show'), '\n')) {
		let r = match(l, /^(\S+) dev \S+ lladdr (\S+)/);
		if (r) m[r[1]] = lc(r[2]);
	}
	return m;
}
function leases() {
	let m = {};
	for (let l in split(readfile('/tmp/dhcp.leases') || '', '\n')) {
		let f = split(trim(l), ' ');
		if (length(f) >= 4) m[lc(f[1])] = f[3] != '*' ? f[3] : '';
	}
	return m;
}

function collect(force) {
	load();
	let now = time();
	if (!force && st.ts && now - st.ts < 2) return;
	let dt = st.ts ? now - st.ts : 0, nb = neigh(), ls = leases(), dk = dayKey(now);
	let day = st.daily[dk] || (st.daily[dk] = { up: 0, down: 0 });
	for (let m, c in st.clients) { c.ur = 0; c.dr = 0; }
	for (let s, dir in SETS) {
		let o = trim(sh('nft -j list set inet bwmon ' + s));
		if (!o) continue;
		try { o = json(o); } catch (e) { continue; }
		for (let e in (o.nftables || [])) {
			for (let x in ((e.set && e.set.elem) || [])) {
				if (type(x) != 'object' || !x.elem || !x.elem.counter) continue;
				let ip = x.elem.val, b = x.elem.counter.bytes, k = s + '|' + ip, p = st.last[k];
				st.last[k] = b;
				let d = (p == null || b < p) ? b : b - p;
				if (!d) continue;
				let mac = nb[ip] || ip;
				let c = st.clients[mac] || (st.clients[mac] = { name: '', ip: '', up: 0, down: 0, ur: 0, dr: 0, last: 0 });
				c[dir] += d; day[dir] += d; c.last = now;
				if (dt) c[dir == 'up' ? 'ur' : 'dr'] += d / dt;
				if (!c.ip || index(ip, ':') < 0) c.ip = ip;
			}
		}
	}
	for (let m, c in st.clients) if (ls[m]) c.name = ls[m];
	let ks = sort(keys(st.daily));
	while (length(ks) > 90) delete st.daily[shift(ks)];
	st.ts = now;
	save();
}

return {
	'luci.bwdash': {
		get: { call: function() {
			collect(false);
			return { ts: st.ts, since: st.since, today: dayKey(st.ts), clients: st.clients, daily: st.daily };
		} },
		collect: { call: function() { collect(true); return {}; } },
		reset: { call: function() {
			load();
			st = { clients: {}, daily: {}, last: st.last, since: time(), ts: 0 };
			save();
			return {};
		} }
	}
};
