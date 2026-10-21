import dotenv from 'dotenv';
import { createApiApp } from './http/app';
import { readHttpConfig } from './http/config';

dotenv.config();

const app = createApiApp(readHttpConfig(process.env));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
