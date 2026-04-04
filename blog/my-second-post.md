# 我的第二篇部落格文章

這是我個人網站上的**第二篇**部落格文章。

在這篇文章中，我將探討一些關於前端開發的最新趨勢，特別是關於 [React Hooks] 的應用。

## React Hooks 應用實例

React Hooks 讓函數式組件也能擁有狀態和生命週期管理，大大簡化了組件的邏輯。

```javascript
import React, { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `You clicked ${count} times`;
  });

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

這只是冰山一角，Hooks 的應用還有很多潛力等待發掘。
