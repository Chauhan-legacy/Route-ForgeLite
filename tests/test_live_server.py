"""
Live Integration Test against Running RouteForge Server
Verifies HTTP 200, frontend delivery (HTML/CSS/JS), and full REST API functionality.
"""
import urllib.request
import json
import sys

def test():
    base = 'http://127.0.0.1:8000'
    print('[1/9] Testing Frontend HTML delivery...')
    resp = urllib.request.urlopen(f'{base}/')
    assert resp.status == 200, f'Expected 200, got {resp.status}'
    html = resp.read().decode('utf-8')
    assert '<title>RouteForge' in html, 'Missing RouteForge title'
    print(f'  -> HTML OK, size: {len(html)} bytes')

    print('[2/9] Testing CSS delivery...')
    resp = urllib.request.urlopen(f'{base}/static/css/styles.css')
    assert resp.status == 200
    css = resp.read().decode('utf-8')
    assert '.app-container' in css
    print(f'  -> CSS OK, size: {len(css)} bytes')

    print('[3/9] Testing JS delivery...')
    resp = urllib.request.urlopen(f'{base}/static/js/app.js')
    assert resp.status == 200
    js = resp.read().decode('utf-8')
    assert 'initApp' in js
    print(f'  -> JS OK, size: {len(js)} bytes')

    print('[4/9] Testing API /api/listRoutes...')
    resp = urllib.request.urlopen(f'{base}/api/listRoutes')
    assert resp.status == 200
    routes = json.loads(resp.read().decode('utf-8'))
    assert routes['ok'] is True
    print(f'  -> listRoutes OK, route count: {len(routes["data"])}')

    print('[5/9] Testing API /api/createRoute...')
    req = urllib.request.Request(
        f'{base}/api/createRoute',
        data=json.dumps({'title': 'Live Verification Route'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    assert resp.status == 200
    created = json.loads(resp.read().decode('utf-8'))
    assert created['ok'] is True
    r_id = created['data']['routeId']
    rev = created['revision']
    print(f'  -> createRoute OK: {r_id} (rev {rev})')

    print('[6/9] Testing API /api/getRoute...')
    req = urllib.request.Request(
        f'{base}/api/getRoute',
        data=json.dumps({'routeId': r_id}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    assert resp.status == 200
    route_data = json.loads(resp.read().decode('utf-8'))
    assert route_data['ok'] is True
    assert route_data['data']['route']['title'] == 'Live Verification Route'
    print('  -> getRoute OK: Title match!')

    print('[7/9] Testing API /api/addStop with geocoding...')
    req = urllib.request.Request(
        f'{base}/api/addStop',
        data=json.dumps({
            'routeId': r_id,
            'expectedRevision': rev,
            'stop': {'name': 'Vienna Opera', 'address': 'Opernring 2, Vienna'}
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    assert resp.status == 200
    stop_res = json.loads(resp.read().decode('utf-8'))
    assert stop_res['ok'] is True
    rev = stop_res['revision']
    stop_id = stop_res["data"]["stopId"]
    print(f'  -> addStop OK: stopId {stop_id} (rev {rev})')

    print('[8/9] Testing API /api/getRouteRevision...')
    req = urllib.request.Request(
        f'{base}/api/getRouteRevision',
        data=json.dumps({'routeId': r_id}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    assert resp.status == 200
    rev_res = json.loads(resp.read().decode('utf-8'))
    assert rev_res['revision'] == rev
    print(f'  -> getRouteRevision OK: {rev_res["revision"]}')

    print('[9/9] Testing API /api/exportRoute...')
    req = urllib.request.Request(
        f'{base}/api/exportRoute',
        data=json.dumps({'routeId': r_id, 'format': 'csv'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    assert resp.status == 200
    exp_res = json.loads(resp.read().decode('utf-8'))
    assert exp_res['ok'] is True
    assert 'Vienna' in exp_res['data']['content']
    print(f'  -> exportRoute OK: CSV generated with size {len(exp_res["data"]["content"])} bytes')

    print('\n=============================================')
    print('ALL 9 LIVE INTEGRATION TESTS PASSED!')
    print('=============================================')

if __name__ == '__main__':
    test()

