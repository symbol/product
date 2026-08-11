import { publicAppConfig } from '@/app/config';

// `pages/404` and `pages/500` are statically prerendered, so the configuration `_app` inlines into
// them is whatever existed at image build time - not at container start (see README "Environment
// Variables"). API routes are never statically optimized, so this reflects the runtime values.
const handler = (request, response) => {
	response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
	response.setHeader('Cache-Control', 'no-store');
	response.status(200).send(`window.appConfig = ${JSON.stringify(publicAppConfig)};`);
};

export default handler;
