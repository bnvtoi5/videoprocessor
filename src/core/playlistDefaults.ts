import { PlaylistVideoItem } from '../types/video';

const VIDEODATA_FILES: Array<{
  fileName: string;
  desc: string;
  res: string;
  defaultSelected: boolean;
}> = [
  {
    fileName: 'comb_01_shaky_people_pexels4101528.mp4',
    desc: 'Combined · Rung tay mạnh + người đi bộ (4.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: true,
  },
  {
    fileName: 'comb_02_aerial_intersection_pexels19130216.mp4',
    desc: 'Combined · Góc cao giao lộ + trôi nhẹ (5.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: true,
  },
  {
    fileName: 'comb_03_night_crowd_pexels38471369.mp4',
    desc: 'Combined · Đám đông ban đêm + ánh sáng phức tạp (6.2s)',
    res: '320×180 · 36 frames',
    defaultSelected: true,
  },
  {
    fileName: 'comb_04_crowd_crossing_pexels4583056.mp4',
    desc: 'Combined · Người qua đường đông đúc (9.4s)',
    res: '320×180 · 36 frames',
    defaultSelected: true,
  },
  {
    fileName: 'comb_05_runner_street_pexels37283732.mp4',
    desc: 'Combined · Người chạy bộ + camera di chuyển (10.0s)',
    res: '320×568 · 36 frames',
    defaultSelected: true,
  },
  {
    fileName: 'bg_01_intersection_traffic_pexels4791734.mp4',
    desc: 'Background · Giao lộ đô thị Montreal (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'bg_02_winter_street_pexels3785878.mp4',
    desc: 'Background · Đường phố mùa đông tuyết trắng (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'bg_03_london_street_pexels5330908.mp4',
    desc: 'Background · Đường phố London xe buýt & taxi (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'bg_04_traffic_cameras_bus_pexels36553218.mp4',
    desc: 'Background · Camera giao thông xe buýt điện (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'bg_05_timelapse_clouds_pexels1388383.mp4',
    desc: 'Background · Time-lapse mây trôi & bóng đổ (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'stab_01_pov_leaves_pexels5597043.mp4',
    desc: 'Stabilization · POV đi bộ trên lá thu (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'stab_02_pov_wet_pavement_pexels4310191.mp4',
    desc: 'Stabilization · POV đi bộ mặt đường ướt (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'stab_03_pov_brick_pavement_pexels3002456.mp4',
    desc: 'Stabilization · POV đi bộ vỉa hè gạch & bóng nắng (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'stab_04_pov_sidewalk_pexels4405576.mp4',
    desc: 'Stabilization · POV đi bộ vỉa hè bê tông & cỏ (10.0s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
  {
    fileName: 'stab_05_pov_dirt_path_pexels3978362.mp4',
    desc: 'Stabilization · POV bước đi đường đất rung mạnh (5.7s)',
    res: '320×180 · 36 frames',
    defaultSelected: false,
  },
];

export const INITIAL_BENCHMARK_PLAYLIST: PlaylistVideoItem[] =
  VIDEODATA_FILES.map((v) => ({
    id: `videodata_${v.fileName}`,
    title: v.fileName,
    subtitle: `${v.res} · ${v.desc}`,
    sourceType: 'upload',
    videoUrl: `/videodata/${v.fileName}`,
    fileName: v.fileName,
    selected: v.defaultSelected,
  }));

