import express from 'express';
import Gun from 'gun';

const app = express();
const port = 8000;
app.use((Gun as any).serve);

const server = app.listen(port, () => {
	console.log('Listening at: http://localhost:' + port + '/gun');
});

Gun({ web: server, localStorage: false, radisk: false });
