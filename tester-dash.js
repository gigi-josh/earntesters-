const filters = document.querySelectorAll('.filter-select');
const filterBtn = document.querySelector('.filter-button');
const searchInput = document.querySelector('.search-box input');
let filterSelect = '';
const fSection = document.querySelector('.featured-section');
const taskCards = document.querySelectorAll('.task-card');
filters.forEach(filter => {
  filter.onchange = () => {
    let search = searchInput.value.trim().toLowerCase();
    if (search === "") { filterSelect = filter.value;
    console.log(filterSelect)
    }
  }
});
filterBtn.onclick = () => {
  let query = searchInput.value.trim().toLowerCase();
  let foundAny = false;
  taskCards.forEach(taCard => {
    let cardContent = taCard.textContent.toLowerCase();
    if (query !== '' && query.length >= 3) {
      if (cardContent.includes(query)) {
        taCard.style.display = '';
        foundAny = true;
      } else {
        taCard.style.display = 'none';
      }
    } else {
      taCard.style.display = '';
    }
    console.log(query)
  });
}
