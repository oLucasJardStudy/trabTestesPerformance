from locust import HttpUser, task, between


class Pokemon(HttpUser):
    host = 'http://node-api:4444'
    wait_time = between(0.5, 1.5)

    @task
    def list(self):
        self.client.get('/pokemon', name='GET /pokemon')
