'use strict';
'require view';
'require dom';
'require rpc';
'require poll';

var callBw = rpc.declare({ object: 'luci.bwdash', method: 'get' });
var callReset = rpc.declare({ object: 'luci.bwdash', method: 'reset' });
var callInfo = rpc.declare({ object: 'system', method: 'info' });
var callBoard = rpc.declare({ object: 'system', method: 'board' });
var callIf = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });

var N = 60, hu = [], hd = [], board, box = {};
var B = function(v) { return '%1024.2mB'.format(v || 0); };
var R = function(v) { return '%1024.1mB/s'.format(v || 0); };

function spark(a, col) {
	var w = 300, h = 60, m = Math.max.apply(null, a.concat([1])),
		p = a.map(function(v, i) {
			return ((N - a.length + i) * w / (N - 1)).toFixed(1) + ',' + (h - v / m * (h - 2) - 1).toFixed(1);
		}).join(' '),
		d = E('div');
	d.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:60px;display:block"><polyline fill="none" stroke="' + col + '" stroke-width="1.5" points="' + p + '"/></svg>';
	return d;
}

function kv(k, v) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', style: 'width:38%;white-space:nowrap' }, k),
		E('td', { 'class': 'td left' }, v)
	]);
}

function bar(p) {
	return E('div', { 'class': 'cbi-progressbar', title: p + '%' }, E('div', { style: 'width:' + p + '%' }));
}

function card(t, c) {
	return E('div', { 'class': 'cbi-section', style: 'margin:0' }, [E('h3', t)].concat(c));
}

function ifAddr(x) {
	var a4 = (x['ipv4-address'] || [])[0];
	if (a4 && a4.address) return a4.address;
	var a6 = (x['ipv6-address'] || [])[0];
	if (a6 && a6.address) return a6.address + (a6.mask ? '/' + a6.mask : '');
	var p6 = (x['ipv6-prefix'] || [])[0];
	if (p6 && p6.address) return p6.address + '/' + p6.mask;
	return '-';
}

function update(r) {
	var i = r[0], ifs = r[1], bw = r[2], cl = [], u = 0, d = 0,
		m = i.memory, used = m.total - (m.available != null ? m.available : m.free),
		pct = Math.round(used / m.total * 100),
		day = (bw.daily || {})[bw.today] || { up: 0, down: 0 };

	Object.keys(bw.clients || {}).forEach(function(k) {
		var c = bw.clients[k];
		c.mac = k;
		u += c.ur;
		d += c.dr;
		cl.push(c);
	});
	cl.sort(function(a, b) { return (b.up + b.down) - (a.up + a.down); });
	hu.push(u);
	hd.push(d);
	if (hu.length > N) { hu.shift(); hd.shift(); }

	dom.content(box.sys, card(_('System'), E('table', { 'class': 'table' }, [
		kv(_('Model'), board.model),
		kv(_('Hostname'), board.hostname),
		kv(_('Uptime'), '%t'.format(i.uptime)),
		kv(_('Load'), i.load.map(function(l) { return (l / 65535).toFixed(2); }).join(' ')),
		kv(_('Memory'), [bar(pct), E('small', B(used) + ' / ' + B(m.total))])
	])));

	dom.content(box.net, card(_('Network'), E('table', { 'class': 'table' },
		ifs.filter(function(x) { return x.up && x.interface != 'loopback'; }).map(function(x) {
			return kv(x.interface + ' (' + x.proto + ')', ifAddr(x) + ' · ' + '%t'.format(x.uptime || 0));
		})
	)));

	dom.content(box.traf, card(_('Traffic'), [
		E('div', { style: 'margin-bottom:6px' }, [
			E('b', { style: 'color:#2a9d3f' }, '↓ ' + R(d)),
			'   ',
			E('b', { style: 'color:#d9534f' }, '↑ ' + R(u))
		]),
		spark(hd, '#2a9d3f'),
		spark(hu, '#d9534f'),
		E('small', _('Today') + ': ↓ ' + B(day.down) + '  ↑ ' + B(day.up))
	]));

	var thStyle = 'white-space:nowrap;padding:6px 10px;text-align:left';
	var tdStyle = 'white-space:nowrap;padding:6px 10px;vertical-align:middle';

	dom.content(box.tbl, E('table', { 'class': 'table', style: 'min-width:540px;width:100%;table-layout:auto' }, [
		E('tr', { 'class': 'tr table-titles' }, [
			_('Client'), '↓', '↑', _('Total ↓'), _('Total ↑'), _('Seen ago')
		].map(function(t) { return E('th', { 'class': 'th', style: thStyle }, t); }))
	].concat(cl.map(function(c) {
		var isMac = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(c.mac);
		var sub = [c.ip, isMac ? c.mac : ''].filter(Boolean).join(' · ');
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', style: tdStyle }, [
				E('strong', c.name || c.mac),
				sub && sub !== (c.name || c.mac) ? E('br') : '',
				sub && sub !== (c.name || c.mac) ? E('small', { style: 'opacity:0.75' }, sub) : ''
			]),
			E('td', { 'class': 'td', style: tdStyle }, R(c.dr)),
			E('td', { 'class': 'td', style: tdStyle }, R(c.ur)),
			E('td', { 'class': 'td', style: tdStyle }, B(c.down)),
			E('td', { 'class': 'td', style: tdStyle }, B(c.up)),
			E('td', { 'class': 'td', style: tdStyle }, c.last ? '%t'.format(Math.max(0, bw.ts - c.last)) : '-')
		]);
	}))));
}

function refresh() {
	return Promise.all([callInfo(), callIf(), callBw()]).then(update);
}

return view.extend({
	load: function() { return callBoard(); },
	render: function(b) {
		board = b;
		box.sys = E('div');
		box.net = E('div');
		box.traf = E('div');
		box.tbl = E('div', { style: 'overflow-x:auto;width:100%;-webkit-overflow-scrolling:touch' });
		poll.add(refresh, 3);
		refresh();
		return E('div', [
			E('h2', _('Dashboard')),
			E('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1em;margin-bottom:1em' }, [box.sys, box.net, box.traf]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Clients')),
				box.tbl,
				E('div', { style: 'margin-top:10px' }, [
					E('button', {
						'class': 'cbi-button cbi-button-negative',
						click: function() { if (confirm(_('Reset all statistics?'))) callReset().then(refresh); }
					}, _('Reset statistics'))
				])
			])
		]);
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
