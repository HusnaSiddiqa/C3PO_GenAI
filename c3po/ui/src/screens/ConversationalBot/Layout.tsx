import { Outlet } from "react-router-dom";
import styled from "styled-components";

const LayoutContainer = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
`;

const Layout = () => {
  return (
    <div className="containers">
      <LayoutContainer>
        <Outlet />
      </LayoutContainer>
    </div>
  );
};

export default Layout;
