// Chinese names of the detection vocabulary and scene attributes.

export const objectZh: Record<string, string> = {
  pedestrian: "行人", people: "人员（非站立）", bicycle: "自行车", car: "小汽车", van: "面包车", truck: "卡车",
  tricycle: "三轮车", "awning-tricycle": "带篷三轮车", bus: "公交车", motor: "摩托车", plane: "飞机", ship: "船只",
  "storage-tank": "储油罐", "baseball-diamond": "棒球场", "tennis-court": "网球场", "basketball-court": "篮球场",
  "ground-track-field": "田径场", harbor: "港口", bridge: "桥梁", "large-vehicle": "大型车辆", "small-vehicle": "小型车辆",
  helicopter: "直升机", roundabout: "环岛", "soccer-ball-field": "足球场", "swimming-pool": "游泳池",
  "container-crane": "集装箱起重机", airport: "机场", helipad: "直升机停机坪",
};

export const attrZh: Record<string, string> = {
  day: "白天", night: "夜间", dusk: "黄昏", clear: "晴", cloudy: "多云", fog: "雾", rain: "雨", snow: "雪",
  nadir: "垂直俯视", oblique: "斜视", side: "侧视", front: "前视", low: "低空", medium: "中空", high: "高空",
};
