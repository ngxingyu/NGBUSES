import requests
headers = {
    'AccountKey': 'ZbYb7MbXREWqZP7RDI6dbg==',
    'accept': 'application/json'
}
def fetch_all(url):
    results = []
    while True:
        new_results = requests.get(
            url,
            headers=headers,
            params={'$skip': len(results)}
        ).json()['value']
        if new_results == []:
            break
        else:
            results += new_results
    return results
stops = fetch_all("http://datamall2.mytransport.sg/ltaodataservice/BusRoutes")
f = open('routes.json','w')
f.write('var r='+str(stops))
f.close()
