import asyncio
import httpx

async def test_live_chat_action():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Login
        login_res = await client.post('http://127.0.0.1:8000/api/v1/auth/login', json={'email': 'demo@omnilife.ai', 'password': 'demo1234'})
        token = login_res.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        # 2. Stream chat asking to add NeuroMed AI
        query = 'add a project to knowledge graph NeuroMed AI using Python and PyTorch'
        print('Sending query:', query)
        
        full_text = []
        async with client.stream('POST', 'http://127.0.0.1:8000/api/v1/chat/stream', json={
            'query': query,
            'mode': 'CLONE'
        }, headers=headers) as resp:
            async for line in resp.aiter_lines():
                if 'delta' in line:
                    full_text.append(line)
        
        print('Chat response received (tokens count):', len(full_text))

        # 3. Check Knowledge Graph endpoint
        graph_res = await client.get('http://127.0.0.1:8000/api/v1/graph/subgraph', headers=headers)
        data = graph_res.json()
        project_names = [n['name'] for n in data['nodes'] if n['label'] == 'Project']
        print('PROJECTS IN KNOWLEDGE GRAPH NOW:', project_names)
        assert 'NeuroMed AI' in project_names, 'NeuroMed AI must be in graph!'
        print('VERIFIED: NeuroMed AI exists in the live Knowledge Graph!')

if __name__ == '__main__':
    asyncio.run(test_live_chat_action())
