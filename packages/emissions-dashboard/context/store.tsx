import React, { createContext, useReducer } from 'react';

interface DefaultState {}

const initialState: DefaultState = {};

const store = createContext(
  initialState as unknown as {
    state: DefaultState;
    dispatch: React.Dispatch<any>;
  },
);
const { Provider } = store;

const StateProvider = ({ children }) => {
  const [state, dispatch] = useReducer((state: DefaultState, action: any) => {
    switch (action.type) {
      default:
        return {
          ...state,
        };
    }
  }, initialState);

  return <Provider value={{ state, dispatch }}>{children}</Provider>;
};

export { store, StateProvider };
