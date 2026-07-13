
document.addEventListener("DOMContentLoaded", function () {
  fetch("data/researchers.json")
    .then((response) => response.json())
    .then((data) => {
      const listContainer = document.getElementById("researcher-list");
      if (!listContainer) return;

      listContainer.innerHTML = ""; // 초기화

      data.forEach((researcher, index) => {
        const item = document.createElement("div");
        item.className = "listing-item";
        item.innerHTML = `
          <div class="right-content align-self-center">
            <h4>${index + 1}. ${researcher["연구자명"] || "이름 없음"}</h4>
            <p><strong>소속:</strong> ${researcher["소속"] || "-"}</p>
            <p><strong>직위:</strong> ${researcher["직위"] || "-"}</p>
            <p><strong>연구분야:</strong> ${researcher["연구분야"] || "-"}</p>
            <p><strong>주요키워드:</strong> ${researcher["주요키워드"] || "-"}</p>
          </div>
        `;
        listContainer.appendChild(item);
      });
    })
    .catch((error) => console.error("데이터 로드 실패:", error));
});
