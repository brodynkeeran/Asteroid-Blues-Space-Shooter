const audioToggleBtn = document.getElementById('audioToggleBtn');
const radioPanel = document.getElementById('radioPanel');
const closeRadioBtn = document.getElementById('closeRadio');
const stationList = document.getElementById('stationList');

// Your audioTracks from earlier (make sure to import or define here)
const audioTracks = [
  { name: "4.44 AM FM", src: "sounds/444FM.wav", unlocked: true },
  { name: "Gas Station Interlude", src: "sounds/gaststationInterlude.wav", unlocked: false },
  { name: "Low Frequency", src: "sounds/LowFrequencyHighVibes.wav", unlocked: false },
  { name: "UFO12 News Station ", src: "sounds/ufosAndCornfields.wav", unlocked: false },
  { name: "Red Dust Transmissions", src: "sounds/WorldDomination.wav", unlocked: false },
];

let currentTrackIndex = 0;
let audio = new Audio(audioTracks[currentTrackIndex].src);
audio.loop = true;
audio.volume = 0.5;
audio.play();

function updateStationList() {
  stationList.innerHTML = "";
  audioTracks.forEach((track, idx) => {
    const li = document.createElement('li');
    li.textContent = track.name + (track.unlocked ? "" : " 🔒");
    li.classList.toggle('active', idx === currentTrackIndex);
    li.style.opacity = track.unlocked ? "1" : "0.4";
    if(track.unlocked) {
      li.addEventListener('click', () => {
        currentTrackIndex = idx;
        audio.src = audioTracks[currentTrackIndex].src;
        audio.play();
        updateStationList();
      });
    }
    stationList.appendChild(li);
  });
}

updateStationList();

audioToggleBtn.addEventListener('click', () => {
    radioPanel.classList.toggle('visible');
  });

  const playPauseBtn = document.getElementById('playPauseBtn');
const npextStationBtn = document.getElementById('nextStationBtn');

function playAudio() {
  audio.play();
  playPauseBtn.textContent = '⏸️ Pause';
}

function pauseAudio() {
  audio.pause();
  playPauseBtn.textContent = '▶️ Play';
}

playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    playAudio();
  } else {
    pauseAudio();
  }
});

nextStationBtn.addEventListener('click', () => {
  // Find next unlocked station
  for (let i = 1; i <= audioTracks.length; i++) {
    const idx = (currentTrackIndex + i) % audioTracks.length;
    if (audioTracks[idx].unlocked) {
      currentTrackIndex = idx;
      audio.src = audioTracks[currentTrackIndex].src;
      audio.play();
      updateStationList();
      playPauseBtn.textContent = '⏸️ Pause';
      break;
    }
  }
});
