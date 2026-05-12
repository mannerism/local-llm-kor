import DefaultTheme from 'vitepress/theme';
import './style.css';

// 기본 테마를 그대로 쓰되, 한국어 줄바꿈을 위한 CSS만 얹는다.
// (한·영 혼합 본문에서 "굴리기"의 "기"가 다음 줄로 떨어지는 문제 등 해결)
export default DefaultTheme;
