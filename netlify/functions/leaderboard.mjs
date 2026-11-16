import {getStore} from '@netlify/blobs';
import {createHandler} from '../../server/leaderboard.mjs';
export default async request=>createHandler(getStore({name:'neon-drive-leaderboard-v1',consistency:'strong'}))(request);
