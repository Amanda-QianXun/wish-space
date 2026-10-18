// 本快照中的姓名、生日、邀请码与认领关系均为虚构演示数据。
import type { AppData } from '../types'
import lampImage from '../assets/wish-lamp.jpg'
import crateImage from '../assets/wish-crate.jpg'
import photoBookImage from '../assets/wish-photo-book.jpg'

export const demoData: AppData = {
  profiles: [
    { id: 'u1', nickname: '小鹿', color: '#E9A59C', birthday: '2000-11-18' },
    { id: 'u2', nickname: '小猫', color: '#8FB8A8', birthday: '2000-10-26' },
    { id: 'u3', nickname: '小熊', color: '#A9A2D4', birthday: '2000-12-09' },
  ],
  groups: [
    {
      id: 'g1', name: '周末放空小组', emoji: '🌿', inviteCode: 'DEMO-8K2P',
      members: [
        { id: 'u1', nickname: '小鹿', color: '#E9A59C', birthday: '2000-11-18' },
        { id: 'u2', nickname: '小猫', color: '#8FB8A8', birthday: '2000-10-26' },
        { id: 'u3', nickname: '小熊', color: '#A9A2D4', birthday: '2000-12-09' },
      ],
    },
    {
      id: 'g2', name: '旅行搭子', emoji: '🚞', inviteCode: 'DEMO-3F7M',
      members: [
        { id: 'u1', nickname: '小鹿', color: '#E9A59C', birthday: '2000-11-18' },
        { id: 'u3', nickname: '小熊', color: '#A9A2D4', birthday: '2000-12-09' },
      ],
    },
  ],
  wishes: [
    {
      id: 'w1', ownerId: 'u2', title: '一盏适合睡前阅读的暖光台灯', kind: 'inspiration', status: 'active',
      priority: 5, category: '家居', budgetMin: 120, budgetMax: 300,
      note: '希望光线柔和一点，放在床头不占地方。', styleNote: '喜欢奶油白、原木或金属银；不要很花哨的造型。',
      image: lampImage,
      groupIds: ['g1'], createdAt: '2026-10-11T09:00:00Z',
    },
    {
      id: 'w2', ownerId: 'u3', title: 'HAY Colour Crate 收纳筐', kind: 'exact', status: 'active',
      priority: 4, category: '家居', platform: '品牌官网', price: 189,
      url: 'https://www.hay.com/', note: 'S号就够了，比较喜欢灰蓝色。',
      image: crateImage,
      groupIds: ['g1', 'g2'], createdAt: '2026-10-08T10:00:00Z',
      overrides: [{ groupId: 'g2', note: '如果旅行时看到类似的中古收纳也可以，不一定同款。' }],
    },
    {
      id: 'w3', ownerId: 'u1', title: '一本关于城市漫步的摄影集', kind: 'inspiration', status: 'active',
      priority: 3, category: '书影音', budgetMin: 80, budgetMax: 260,
      note: '中文或英文都可以，希望图片比例高一点。', styleNote: '城市观察、街头摄影、地图叙事都喜欢。',
      image: photoBookImage,
      groupIds: ['g1', 'g2'], createdAt: '2026-10-05T08:00:00Z',
    },
  ],
  claims: [{ wishId: 'w2', groupId: 'g1', claimedBy: 'u2', state: 'reserved' }],
}
