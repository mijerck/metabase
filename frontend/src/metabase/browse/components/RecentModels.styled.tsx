import styled from "@emotion/styled";

export const RecentModelsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, calc(25% - .5rem)));
  gap: 0.5rem;
  margin: 0;
  width: 100%;
  margin-bottom: 0.5rem;
`;
